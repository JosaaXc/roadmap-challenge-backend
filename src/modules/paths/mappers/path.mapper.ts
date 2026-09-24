import type { PathWithGraph } from '../paths.service.js';
import type { PathResponseDto } from '../dto/path-response.dto.js';

export class PathMapper {
  static toResponseDto(path: PathWithGraph, callerUserId: string): PathResponseDto {
    const isOwner = path.userId === callerUserId;
    const nextNode = isOwner ? path.nodes.find((node) => !node.isCompleted) : null;

    return {
      id: path.id,
      userId: path.userId,
      title: path.title,
      description: path.description,
      progress: path.progress,
      imageUrl: path.imageUrl,
      isFavorite: path.isFavorite,
      isPublic: path.isPublic,
      nodes: path.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        title: node.title,
        isCompleted: node.isCompleted,
        position: node.position,
        courseId: node.courseId,
        imageUrl: node.course?.imageUrl ?? null,
        externalUrl: node.externalUrl,
      })),
      edges: path.edges.map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        isOptional: edge.isOptional,
      })),
      nextStep: nextNode?.title ?? null,
      createdAt: path.createdAt,
      updatedAt: path.updatedAt,
    };
  }
}
