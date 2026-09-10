import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  telegramUserId: string;

  @Prop({ default: "" })
  name: string;

  @Prop({ default: "Software Professional" })
  role: string;

  @Prop({ type: [String], default: [] })
  topics: string[];

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({
    type: [
      {
        name: String,
        description: String,
        highlights: [String],
      },
    ],
    default: [],
  })
  projects: Array<{
    name: string;
    description: string;
    highlights: string[];
  }>;

  @Prop({
    type: Object,
    default: {
      frequency: "daily",
      preferredHour: 10,
      timezone: "Asia/Kolkata",
    },
  })
  postingSchedule: {
    frequency: string;
    preferredHour: number;
    timezone: string;
  };

  @Prop({ default: null })
  professionalPhotoPath: string;

  @Prop({
    type: Object,
    default: null,
  })
  linkedIn: {
    accessToken: string;
    expiresIn?: number;
    savedAt?: number;
    memberUrn?: string;
    profileName?: string;
  } | null;

  @Prop({ default: false })
  isOnboarded: boolean;

  @Prop({ default: "telegram" })
  channel: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

