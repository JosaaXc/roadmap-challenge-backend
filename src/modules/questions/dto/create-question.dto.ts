import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateQuestionOptionDto {
  @ApiProperty({ example: 'Frontend (Interfaces y Web)' })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiProperty({ type: [String], example: ['frontend'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'tagsOutput must contain at least 1 tag' })
  tagsOutput!: string[];
}

export class CreateQuestionDto {
  @ApiProperty({ example: '¿En qué área principal te gustaría especializarte?' })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  order!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  isRequired!: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [CreateQuestionOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  @ArrayMinSize(2, { message: 'Question must have at least 2 options' })
  options!: CreateQuestionOptionDto[];
}

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}

export class UpdateQuestionOptionDto extends PartialType(CreateQuestionOptionDto) {}
