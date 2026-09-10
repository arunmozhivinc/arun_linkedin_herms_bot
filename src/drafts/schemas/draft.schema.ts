import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type DraftDocument = Draft & Document;

@Schema({ timestamps: true })
export class Draft {
  @Prop({ required: true, unique: true, index: true })
  draftId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ default: "SHORT_POST", enum: ["SHORT_POST", "ARTICLE"] })
  postType: string;

  @Prop({
    default: "PENDING_APPROVAL",
    enum: ["PENDING_APPROVAL", "APPROVED", "PUBLISHED", "REJECTED"],
    index: true,
  })
  status: string;

  @Prop({ required: true })
  text: string;

  @Prop({ type: Object, default: null })
  articleContent: {
    title?: string;
    subtitle?: string;
    canonicalUrl?: string;
  } | null;

  @Prop({ type: Object, default: null })
  media: {
    type: string;
    url?: string;
    localPath?: string;
    prompt?: string;
    altText?: string;
  } | null;

  @Prop({ type: Object, default: {} })
  metadata: {
    topic?: string;
    tags?: string[];
    archetype?: string;
  };

  @Prop({ required: true })
  contentHash: string;

  @Prop({ default: null })
  approvedAt: Date;

  @Prop({ default: null })
  approvedBy: string;

  @Prop({ default: null })
  publishedAt: Date;

  @Prop({ default: null })
  postId: string;

  @Prop({ default: null })
  authorUrn: string;

  @Prop({ default: null })
  rejectionReason: string;
}

export const DraftSchema = SchemaFactory.createForClass(Draft);

