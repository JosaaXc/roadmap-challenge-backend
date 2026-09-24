import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({ example: 'NestJS: De cero a experto' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'nest-cero-experto' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must contain only lowercase alphanumeric characters and hyphens',
  })
  slug!: string;

  @ApiProperty({ example: 'Aprende NestJS paso a paso con Fernando Herrera.' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], example: 'INTERMEDIATE' })
  @IsString()
  @IsIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
  level!: string;

  @ApiProperty({ type: [String], example: ['backend', 'nestjs', 'typescript'] })
  @IsArray()
  @IsString({ each: true })
  tags!: string[];

  @ApiProperty({ example: 'https://cursos.devtalles.com/courses/nest-cero-experto' })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true, example: 'https://api.dicebear.com/7.x/shapes/svg?seed=nest' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
