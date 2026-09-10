import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, required: true, unique: true, index: true })
  telegramUserId: string;

  @Prop({ type: String, default: "" })
  name: string;

  @Prop({ type: String, default: "Software Professional" })
  role: string;

  @Prop({ type: [String], default: [] })
  positions: string[];

  @Prop({ type: [String], default: [] })
  topics: string[];

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({ type: String, default: "" })
  bioContext: string;

  @Prop({
    type: String,
    default: "COMPLETED",
    enum: ["NAME", "POSITION", "SKILLS", "CUSTOM_DATA", "SCHEDULE", "COMPLETED"],
  })
  onboardingStep: string;

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
      preferredHour: 19, // default 7:00 PM
      timezone: "Asia/Kolkata",
    },
  })
  postingSchedule: {
    frequency: string;
    preferredHour: number;
    timezone: string;
  };

  @Prop({ type: String, default: null })
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

  @Prop({ type: Boolean, default: false })
  isOnboarded: boolean;

  @Prop({ type: String, default: "telegram" })
  channel: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
