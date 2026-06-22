import { Injectable } from '@nestjs/common';
import { CloudTasksClient, protos } from '@google-cloud/tasks';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QueueService {
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

    const parent = this.client.queuePath(projectId, location, input.queueName);

    const task: protos.google.cloud.tasks.v2.ITask = {
      httpRequest: {
        httpMethod: 'POST',
        url: `${baseUrl}/queues/jobs`,
        headers: {
          'Content-Type': 'application/json',
        },
        body: Buffer.from(
          JSON.stringify({
            type: input.type,
            payload: input.payload,
          }),
        ).toString('base64'),
      },
    };

    const [response] = await this.client.createTask({
      parent,
      task,
    });

    return response.name ?? undefined;
  }
}
