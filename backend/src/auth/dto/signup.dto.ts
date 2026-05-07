import { IsEmail, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).*$/, {
    message: 'Password must contain at least one letter and one digit',
  })
  password!: string;

  @IsString() @MinLength(1) @MaxLength(80)
  firstName!: string;

  @IsString() @MinLength(1) @MaxLength(80)
  lastName!: string;

  @IsString() @MinLength(2) @MaxLength(120)
  companyName!: string;

  @IsOptional() @IsString() @MaxLength(120)
  storeName?: string;

  @IsOptional() @IsString()
  locale?: string;
}
