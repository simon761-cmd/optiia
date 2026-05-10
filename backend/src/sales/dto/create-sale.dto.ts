import { IsString, IsArray, IsOptional, IsInt, Min, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class SaleItemDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateSaleDto {
  @IsString()
  clientId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  @IsOptional()
  @IsIn(['PENDING', 'READY', 'DELIVERED', 'QUOTE'])
  status?: 'PENDING' | 'READY' | 'DELIVERED' | 'QUOTE';
}
