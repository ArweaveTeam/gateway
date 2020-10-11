import { orderBy } from "lodash";
import { streamToJson } from "../lib/streams";
import { request } from "../lib/http";

interface NodeStatus {
  host: string;
  online: boolean;
  responseTime: number;
  response: any;
}

interface NodeMonitoringConfig {
  enabled?: boolean;
  interval?: number;
  timeout?: number;
}

const state: {
  config: NodeMonitoringConfig;
  timer: NodeJS.Timeout | null;
  nodes: NodeStatus[];
} = {
  config: {
    enabled: false,
    interval: 30000,
    timeout: 20000,
  },
  timer: null,
  nodes: [],
};

export function configureMonitoring({
  enabled = true,
  interval = 30000,
  timeout = 20000,
}: NodeMonitoringConfig = {}) {
  state.config.enabled = enabled;

  if (interval) {
    state.config.interval = interval;
  }

  if (timeout) {
    state.config.timeout = timeout;
  }

  if (state.timer) {
    clearInterval(state.timer);
  }

  if (enabled && interval > 0) {
    refreshStatus();
    state.timer = setInterval(refreshStatus, interval);
  }
}

export function getNodes() {
  return state.nodes;
}

export function getOnlineHosts() {
  const onlineHosts = state.nodes
    .filter((node) => node.online)
    .map((node) => node.host);

  // In case there is ever an issue with all hosts appearing offline
  // then simply return all known hosts as a fail-safe.
  if (onlineHosts.length > 0) {
    return onlineHosts;
  }

  state.nodes.map((node) => node.host);
}

export function setHosts(hosts: string[]) {
  state.nodes = hosts.map((host) => {
    return {
      host,
      online: true,
      responseTime: -1,
      response: {},
    };
  });
}

const refreshStatus = async () => {
  state.nodes = orderBy(
    await pingStatus(state.nodes.map((node) => node.host)),
    // Order by all online hosts first, then the highest blocks first,
    // and then sort by fastest (lowest) response time.
    ["online", "status.height", "responseTime"],
    ["desc", "desc", "asc"]
  );
};

const pingStatus = (hosts: string[]): Promise<NodeStatus[]> => {
  return Promise.all(
    hosts.map(async (host) => {
      try {
        const { duration, data } = await request({
          endpoint: host,
          timeout: 20000,
        });

        return {
          host,
          online: true,
          responseTime: duration,
          response: await streamToJson(data),
        };
      } catch (error) {
        return {
          host,
          online: false,
          response: {},
          responseTime: -1,
        };
      }
    })
  );
};
