import { IsString } from 'class-validator';

export class ExtractOcrDto {
  @IsString()
  imageDataUrl!: string;
}
