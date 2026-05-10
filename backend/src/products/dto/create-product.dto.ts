import { IsString, IsOptional, IsNumber, IsArray, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  sku!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsIn(['FRAME', 'LENS', 'CONTACT_LENS', 'ACCESSORY', 'SOLUTION'])
  category!: 'FRAME' | 'LENS' | 'CONTACT_LENS' | 'ACCESSORY' | 'SOLUTION';

  @IsOptional()
  @IsString()
  subcategory?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellPriceTtc!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPriceHt?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  vatRate?: number;

  @IsOptional() @IsString() frameMaterial?: string;
  @IsOptional() @IsString() frameColor?: string;
  @IsOptional() @IsString() frameShape?: string;
  @IsOptional() @IsString() frameSize?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lensIndex?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lensTreatment?: string[];

  @IsOptional()
  @IsString()
  supplierId?: string;
}
