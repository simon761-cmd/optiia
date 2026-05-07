import { IsString, MinLength } from 'class-validator';

export class ExtractOcrDto {
  /** Image en data URL base64, ex: "data:image/jpeg;base64,/9j/4AAQ..." */
  @IsString()
  @MinLength(50)
  imageDataUrl!: string;
}