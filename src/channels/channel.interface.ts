export interface DraftPreviewPayload {
  draftId: string;
  postType: "SHORT_POST" | "ARTICLE";
  text: string;
  topic?: string;
  previewUrl: string;
  approvalUrl: string;
  imageUrl?: string;
  prompt?: string;
}

export interface INotificationChannel {
  channelName: string;
  sendDraftPreview(channelUserId: string, payload: DraftPreviewPayload): Promise<void>;
  sendPublishSuccess(channelUserId: string, draftId: string, postId: string): Promise<void>;
  sendDirectMessage(channelUserId: string, message: string): Promise<void>;
}

