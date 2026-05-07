import { IsString } from 'class-validator';

export class OcrPrescriptionDto {
  @IsString()
  clientId!: string;

  /** Clé S3 retournée par le presigned upload */
  @IsString()
  imageS3Key!: string;
}
