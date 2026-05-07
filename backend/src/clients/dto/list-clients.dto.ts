import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListClientsDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString()
  cursor?: string;

  @IsOptional() @IsString()
  storeId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}
