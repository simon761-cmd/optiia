import { IsString, IsOptional, IsNumber, IsInt, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePrescriptionDto {
  @IsString()
  clientId!: string;

  @IsOptional() @IsString()
  type?: 'GLASSES' | 'CONTACT_LENSES' | 'EXAM';

  @IsOptional() @IsString()
  doctorName?: string;

  @IsOptional() @IsString()
  doctorRpps?: string;

  @IsOptional() @IsDateString()
  issuedAt?: string;

  @IsOptional() @IsDateString()
  validUntil?: string;

  // Œil droit
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-30) @Max(30)
  odSphere?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-10) @Max(10)
  odCylinder?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(180)
  odAxis?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5)
  odAddition?: number;

  // Œil gauche
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-30) @Max(30)
  ogSphere?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-10) @Max(10)
  ogCylinder?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(180)
  ogAxis?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5)
  ogAddition?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(40) @Max(80)
  pupillaryDistance?: number;

  @IsOptional() @IsString()
  notes?: string;
}