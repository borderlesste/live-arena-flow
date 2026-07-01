import { CloudflareStreamProvider, getCloudflareStreamConfig } from "./cloudflare.provider.js";
import { RestreamProvider, getRestreamConfig } from "./restream.provider.js";
import type {
  CreatedLiveInput,
  CreateLiveInputInput,
  LiveInputStatus,
  LiveStreamProvider,
  ProviderCredentials,
  ProviderLiveInput,
} from "./types.js";

/**
 * OBS publishes to Restream while a per-source Cloudflare Live Input provides
 * the RTMPS relay destination and public HLS playback URL.
 */
export class RestreamCloudflareProvider implements LiveStreamProvider {
  readonly name = "restream_cloudflare";

  private readonly restream = new RestreamProvider();
  private readonly cloudflare = new CloudflareStreamProvider();

  async createLiveInput(input: CreateLiveInputInput): Promise<CreatedLiveInput> {
    // Validate both configurations before creating remote infrastructure.
    getRestreamConfig();
    getCloudflareStreamConfig();

    const obsCredentials = await this.restream.getCredentials();
    const cloudflareInput = await this.cloudflare.createLiveInput({ ...input, recordingEnabled: true });

    return {
      provider: this.name,
      providerInputId: cloudflareInput.providerInputId,
      ingestProtocol: obsCredentials.ingestProtocol,
      ingestUrl: obsCredentials.ingestUrl,
      streamKey: obsCredentials.streamKey,
      playbackFormat: cloudflareInput.playbackFormat,
      playbackUrl: cloudflareInput.playbackUrl,
      status: cloudflareInput.status,
      relayDestination: {
        ingestProtocol: cloudflareInput.ingestProtocol,
        ingestUrl: cloudflareInput.ingestUrl,
        streamKey: cloudflareInput.streamKey,
      },
    };
  }

  async getLiveInput(providerInputId: string): Promise<ProviderLiveInput> {
    const [obsCredentials, cloudflareInput] = await Promise.all([
      this.restream.getCredentials(),
      this.cloudflare.getLiveInput(providerInputId),
    ]);
    return {
      providerInputId,
      enabled: cloudflareInput.enabled,
      status: cloudflareInput.status,
      ingestUrl: obsCredentials.ingestUrl,
      streamKey: obsCredentials.streamKey,
    };
  }

  async getCredentials(providerInputId: string): Promise<ProviderCredentials> {
    const [obsCredentials, relayDestination] = await Promise.all([
      this.restream.getCredentials(),
      this.cloudflare.getCredentials(providerInputId),
    ]);
    return { ...obsCredentials, relayDestination };
  }

  getLiveInputStatus(providerInputId: string): Promise<LiveInputStatus> {
    return this.cloudflare.getLiveInputStatus(providerInputId);
  }

  updateLiveInput(providerInputId: string, input: {
    enabled?: boolean;
    name?: string;
    lowLatencyEnabled?: boolean;
  }): Promise<void> {
    return this.cloudflare.updateLiveInput(providerInputId, input);
  }

  disableLiveInput(providerInputId: string): Promise<void> {
    return this.cloudflare.disableLiveInput(providerInputId);
  }

  enableLiveInput(providerInputId: string): Promise<void> {
    return this.cloudflare.enableLiveInput(providerInputId);
  }

  deleteLiveInput(providerInputId: string): Promise<void> {
    return this.cloudflare.deleteLiveInput(providerInputId);
  }
}
