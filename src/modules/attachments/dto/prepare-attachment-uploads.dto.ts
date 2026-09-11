import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';

import { AttachmentUploadFileDto } from './attachment-upload-file.dto';

export class PrepareAttachmentUploadFileDto extends AttachmentUploadFileDto {}

export class PrepareAttachmentUploadsDto {
  @ApiProperty({
    description:
      'Files prepared in one API request. Each returned signed form must be uploaded separately and may be sent in parallel.',
    type: [PrepareAttachmentUploadFileDto],
    minItems: 1,
    maxItems: 10,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrepareAttachmentUploadFileDto)
  files: PrepareAttachmentUploadFileDto[];
}
