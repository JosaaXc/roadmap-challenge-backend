import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NodeType } from '@prisma/client';

export class PathNodeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: NodeType, example: NodeType.DEVTALLES_COURSE })
  type!: NodeType;

  @ApiProperty({ example: 'NestJS: De cero a experto' })
  title!: string;

  @ApiProperty({ example: false })
  isCompleted!: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  courseId!: string | null;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  externalUrl!: string | null;
}

export class PathEdgeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  sourceNodeId!: string;

  @ApiProperty({ format: 'uuid' })
  targetNodeId!: string;

  @ApiProperty({ example: false })
  isOptional!: boolean;
}

export class PathResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ruta Personalizada: Frontend & React' })
  title!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 0 })
  progress!: number;

  @ApiProperty({ example: false })
  isFavorite!: boolean;

  @ApiProperty({ type: [PathNodeResponseDto] })
  nodes!: PathNodeResponseDto[];

  @ApiProperty({ type: [PathEdgeResponseDto] })
  edges!: PathEdgeResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class NodeProgressResponseDto {
  @ApiProperty({ type: PathNodeResponseDto })
  node!: PathNodeResponseDto;

  @ApiProperty({ example: 33.3, description: 'Path progress percentage (1 decimal).' })
  progress!: number;
}

export class FavoriteResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: true })
  isFavorite!: boolean;
}
