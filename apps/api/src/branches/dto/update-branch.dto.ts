import {
    IsOptional,
    IsString,
} from 'class-validator';
  
export class UpdateBranchDto {
    @IsOptional()
    @IsString()
    code?: string;
  
    @IsOptional()
    @IsString()
    name?: string;
  
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