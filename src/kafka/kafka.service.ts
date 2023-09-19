import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import {
  circuitBreaker,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  retry,
  wrap,
} from "cockatiel";
import {
  Kafka,
  KafkaConfig,
  logLevel,
  Consumer,
  Producer,
  Message,
} from "kafkajs";

@Injectable()
export class KafkaService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  retryEl = retry(handleAll, {
    maxAttempts: 20,
    backoff: new ExponentialBackoff(),
  });

  circuitBreakerEl = circuitBreaker(handleAll, {
    halfOpenAfter: 2 * 1000,
    breaker: new ConsecutiveBreaker(5),
  });

  retryWithBreaker = wrap(this.retryEl, this.circuitBreakerEl);

  async onApplicationBootstrap() {
    this.connect();
  }

  onApplicationShutdown(signal: string) {
    this.disconnect();
  }
  private logger: Logger;

  constructor() {
    this.logger = new Logger(KafkaService.name);
  }

  private getKafkaConfig(): KafkaConfig {
    return {
      logLevel: logLevel.ERROR,
      clientId: "reporting-client",
      connectionTimeout: 3000,
      authenticationTimeout: 15000,
      requestTimeout: 25000,
      brokers: ["kafka:9092"],
    };
  }

  private kafka: Kafka;
  private consumer: Consumer;
  private producer: Producer;

  public async connect() {
    this.kafka = new Kafka(this.getKafkaConfig());
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({
      groupId: `reporting-consumer-v1`,
    });
    await this.producer.connect();
    await this.consumer.connect();
  }

  public async disconnect() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
  }

  public async sendMessage(messages: Array<unknown>, topic: string) {
    const formattedMessages: Message[] = messages.map((message) => {
      return { value: JSON.stringify(message) };
    });

    try {
      this.retryWithBreaker.execute(() =>
        this.producer.send({ topic, messages: formattedMessages }),
      );
    } catch (error) {
      console.error("Could not send producer message", error);
      this.sendDLXMessage(error, topic);
    }
  }

  public async sendDLXMessage(msgErr: unknown, erroredTopic: string) {
    try {
      this.producer.send({
        topic: "dlx-logs",
        messages: [
          {
            value: JSON.stringify({
              topic: erroredTopic,
              error: msgErr,
            }),
          },
        ],
      });
    } catch (error) {
      console.error("Could not send DLX message", error);
    }
  }

  public async hasConnected() {
    return !!this.producer;
  }
}
