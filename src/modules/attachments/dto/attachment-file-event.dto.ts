import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttachmentStorageObjectDataDto {
  @ApiProperty({ example: 'clean-hvac-attachments-dev' })
  bucket: string;

  @ApiProperty({
    example:
      'tenants/6357a3ee-1b91-49e0-98ff-b180803c12e1/attachments/c88d089a-fc15-4de0-a09c-8e7a359ec4d5.jpg',
  })
  name: string;

  @ApiProperty({ example: '1770000000000000' })
  generation: string;

  @ApiProperty({ example: '3145728' })
  size: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  contentType?: string;
}
