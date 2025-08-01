import { check, group } from 'k6';
import { createClient } from './modules/client.js';
import { createTestOrgIfNotExists, upsertTestdataDatasource, upsertDashboard } from './modules/util.js';

export let options = {
  noCookiesReset: true,
};

let endpoint = __ENV.URL || 'http://localhost:3000';
let authToken = __ENV.AUTH_TOKEN || '';

const client = createClient(endpoint);
const dashboard = JSON.parse(open('fixtures/graph_panel.json'));

export const setup = () => {
  if (!authToken) {
    group('user authenticates thru ui with username and password', () => {
      let res = client.ui.login('admin', 'admin');

      check(res, {
        'response status is 200': (r) => r.status === 200,
      });
    });
  } else {
    client.withAuthToken(authToken);
  }

  const orgId = createTestOrgIfNotExists(client);
  client.withOrgId(orgId);
  upsertTestdataDatasource(client, dashboard.panels[0].datasource);
  upsertDashboard(client, dashboard);

  return {
    orgId,
    cookies: client.saveCookies(),
  };
};

export default (data) => {
  client.loadCookies(data.cookies);
  client.withOrgId(data.orgId);

  if (authToken) {
    client.withAuthToken(authToken);
  }

  group('render test', () => {
    group('render graph panel', () => {
      const response = client.ui.renderPanel(data.orgId, dashboard.uid, dashboard.panels[0].id);
      check(response, {
        'response status is 200': (r) => r.status === 200,
        'response is a PNG': (r) => r.headers['Content-Type'] == 'image/png',
      });
    });
  });
};

export const teardown = () => {};
