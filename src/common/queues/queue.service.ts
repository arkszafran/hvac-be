import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CloudTasksClient, protos } from '@google-cloud/tasks';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly client: CloudTasksClient;

  constructor(private readonly configService: ConfigService) {
    this.client = new CloudTasksClient();
  }

  async enqueue(input: {
    queueName: string;
    type: string;
    payload: unknown;
  }): Promise<string | undefined> {
    const projectId = this.configService.getOrThrow<string>('GCP_PROJECT_ID');
    const location = this.configService.getOrThrow<string>('GCP_LOCATION');
    const baseUrl = this.configService.getOrThrow<string>(
      'PUBLIC_WORKER_BASE_URL',
    );
    const serviceAccountEmail = this.configService.getOrThrow<string>(
      'QUEUE_JOBS_OIDC_SERVICE_ACCOUNT_EMAIL',
    );
    const audience = this.configService.getOrThrow<string>(
      'QUEUE_JOBS_OIDC_AUDIENCE',
    );

    const parent = this.client.queuePath(projectId, location, input.queueName);
    const url = `${baseUrl}/queues/jobs`;

    const task: protos.google.cloud.tasks.v2.ITask = {
      httpRequest: {
        httpMethod: 'POST',
        url,
        headers: {
          'Content-Type': 'application/json',
        },
        oidcToken: {
          serviceAccountEmail,
          audience,
        },
        body: Buffer.from(
          JSON.stringify({
            type: input.type,
            payload: input.payload,
          }),
        ).toString('base64'),
      },
    };

    let response: protos.google.cloud.tasks.v2.ITask;

    try {
      [response] = await this.client.createTask({
        parent,
        task,
      });
    } catch (error) {
      this.logger.error(
        `Queue task creation failed for parent "${parent}", url "${url}", OIDC service account "${serviceAccountEmail}", audience "${audience}".`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new ServiceUnavailableException('Queue task could not be created.');
    }

    this.logger.log(
      `Queued task${response.name ? ` ${response.name}` : ''} for ${input.queueName}.`,
    );

    return response.name ?? undefined;
  }
}
