import {
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';
  
export class CreateBranchDto {
    @IsString()
    @IsNotEmpty()
    code!: string;
  
    @IsString()
    @IsNotEmpty()
    name!: string;
  
    @IsOptional()
    @IsString()
    address?: string;
  
    @IsOptional()
    @IsString()
    phone?: string;
  
    @IsOptional()
    @IsString()
    logoUrl?: string;
}