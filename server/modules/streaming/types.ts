import type { LiveSourceStatus } from "../../../src/schemas/live-source.schema.js";

export type LiveInputStatus = LiveSourceStatus;

export interface CreatedLiveInput {
  provider: string;
  providerInputId: string;
  ingestProtocol: "rtmps" | "rtmp" | "srt";
  ingestUrl: string;
  streamKey: string;
  playbackFormat: "hls" | "dash";
  playbackUrl: string | null;
  status: LiveInputStatus;
}

export interface CreateLiveInputInput {
  name: string;
  eventId?: string;
  sourceId?: string;
  recordingEnabled?: boolean;
  lowLatencyEnabled?: boolean;
}

export interface ProviderLiveInput {
  providerInputId: string;
  enabled: boolean;
  status: LiveInputStatus;
  ingestUrl: string;
  streamKey: string;
}

export interface RotatedLiveInputCredentials {
  streamKey: string;
  ingestUrl: string;
}

export interface LiveStreamProvider {
  readonly name: string;
  createLiveInput(input: CreateLiveInputInput): Promise<CreatedLiveInput>;
  getLiveInput?(providerInputId: string): Promise<ProviderLiveInput>;
  getLiveInputStatus(providerInputId: string): Promise<LiveInputStatus>;
  updateLiveInput?(providerInputId: string, input: { enabled?: boolean; name?: string }): Promise<void>;
  getCredentials?(providerInputId: string): Promise<RotatedLiveInputCredentials & { ingestProtocol: "rtmps" | "rtmp" | "srt" }>;
  disableLiveInput(providerInputId: string): Promise<void>;
  enableLiveInput(providerInputId: string): Promise<void>;
  deleteLiveInput(providerInputId: string): Promise<void>;
  rotateCredentials?(providerInputId: string): Promise<RotatedLiveInputCredentials>;
}
