import { ApiProperty } from '@nestjs/swagger';

export class QuestionOptionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Frontend (Interfaces y Web)' })
  text!: string;
}

export class QuestionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '¿En qué área principal te gustaría especializarte?' })
  text!: string;

  @ApiProperty({ example: true })
  isRequired!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ type: [QuestionOptionResponseDto] })
  options!: QuestionOptionResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
