import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PrescriptionType } from '@prisma/client';

export class EyeDto {
  @IsOptional() @IsNumber() sphere?: number;
  @IsOptional() @IsNumber() cylinder?: number;
  @IsOptional() @IsInt() axis?: number;
  @IsOptional() @IsNumber() addition?: number;
}

export class CreatePrescriptionDto {
  @IsString()
  clientId!: string;

  @IsEnum(PrescriptionType)
  type!: PrescriptionType;

  @IsOptional() @IsString() doctorName?: string;
  @IsOptional() @IsString() doctorRpps?: string;
  @IsOptional() @IsDateString() issuedAt?: string;
  @IsOptional() @IsDateString() validUntil?: string;

  @IsOptional() @ValidateNested() @Type(() => EyeDto) od?: EyeDto;
  @IsOptional() @ValidateNested() @Type(() => EyeDto) og?: EyeDto;

  @IsOptional() @IsNumber()
  pupillaryDistance?: number;

  @IsOptional() @IsString()
  notes?: string;
}
