import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CourseResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'NestJS: De cero a experto' })
  title!: string;

  @ApiProperty({ example: 'nest-cero-experto' })
  slug!: string;

  @ApiProperty({ example: 'Aprende NestJS paso a paso con Fernando Herrera.' })
  description!: string;

  @ApiProperty({ enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], example: 'INTERMEDIATE' })
  level!: string;

  @ApiProperty({ type: [String], example: ['backend', 'nestjs', 'typescript'] })
  tags!: string[];

  @ApiProperty({ example: 'https://cursos.devtalles.com/courses/nest-cero-experto' })
  url!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
