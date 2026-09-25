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

  @ApiProperty({ example: 0, description: 'Deterministic order within the path.' })
  position!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  courseId!: string | null;

  @ApiPropertyOptional({ type: 'string', nullable: true, example: 'https://placehold.co/800x450/111827/a855f7?text=NestJS' })
  imageUrl!: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description:
      'Link to open for this node: the DevTalles course URL on DEVTALLES_COURSE nodes, the custom link on EXTERNAL_LINK ones.',
    example: 'https://cursos.devtalles.com/courses/docker-guia-practica',
  })
  url!: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: 'Custom link, only on EXTERNAL_LINK nodes. Always null on course nodes — use `url` instead.',
  })
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

  @ApiProperty({ format: 'uuid', description: 'Owner id — compare with GET /users/me to know if it is yours.' })
  userId!: string;

  @ApiProperty({ example: 'Ruta Personalizada: Frontend & React' })
  title!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 0 })
  progress!: number;

  @ApiPropertyOptional({ type: 'string', nullable: true, example: 'https://placehold.co/800x450/111827/a855f7?text=Frontend' })
  imageUrl!: string | null;

  @ApiProperty({ example: false })
  isFavorite!: boolean;

  @ApiProperty({ example: false })
  isPublic!: boolean;

  @ApiProperty({ type: [PathNodeResponseDto] })
  nodes!: PathNodeResponseDto[];

  @ApiProperty({ type: [PathEdgeResponseDto] })
  edges!: PathEdgeResponseDto[];

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description:
      'Title of the first incomplete node for the path owner. Returns null if the path is 100% completed OR if viewed by a non-owner user (foreign public path).',
    example: 'NestJS: De cero a experto',
  })
  nextStep!: string | null;

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

export class VisibilityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: true })
  isPublic!: boolean;
}
