import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString() @MaxLength(80)
  firstName!: string;

  @IsString() @MaxLength(80)
  lastName!: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsDateString()
  birthDate?: string;

  @IsOptional() @IsIn(['M', 'F', 'X'])
  gender?: 'M' | 'F' | 'X';

  @IsOptional() @IsString() @MaxLength(200)
  addressLine1?: string;

  @IsOptional() @IsString() @MaxLength(20)
  postalCode?: string;

  @IsOptional() @IsString() @MaxLength(120)
  city?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsBoolean()
  marketingConsent?: boolean;

  @IsOptional() @IsDateString()
  marketingConsentAt?: string;
}
