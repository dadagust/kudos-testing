import { IntegrationAdapter, IntegrationDescriptor } from '@/entities/integration';

import { INTEGRATIONS_FIXTURE } from './data';

class StaticIntegrationAdapter implements IntegrationAdapter {
  readonly id: string;
  readonly provider: IntegrationDescriptor['provider'];
  readonly name: string;
  readonly description: string;
  readonly capabilities: IntegrationDescriptor['capabilities'];

  private readonly descriptor: IntegrationDescriptor;

  constructor(descriptor: IntegrationDescriptor) {
    this.id = descriptor.id;
    this.provider = descriptor.provider;
    this.name = descriptor.name;
    this.description = descriptor.description;
    this.capabilities = descriptor.capabilities;
    this.descriptor = descriptor;
  }

  async fetchDescriptor(): Promise<IntegrationDescriptor> {
    return { ...this.descriptor };
  }
}

export const integrationAdapters: IntegrationAdapter[] = INTEGRATIONS_FIXTURE.map(
  (descriptor) => new StaticIntegrationAdapter(descriptor)
);

export const listIntegrationDescriptors = async (): Promise<IntegrationDescriptor[]> => {
  const descriptors = await Promise.all(
    integrationAdapters.map((adapter) => adapter.fetchDescriptor())
  );

  return descriptors.sort((a, b) => a.name.localeCompare(b.name));
};
