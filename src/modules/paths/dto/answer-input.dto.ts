import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AnswerInputDto {
  @ApiProperty({ description: 'Answered question id (must be active).', example: 'q1-role' })
  @IsString()
  questionId!: string;

  @ApiProperty({ format: 'uuid', description: 'Selected option id (must belong to the question).' })
  @IsString()
  optionId!: string;
}
