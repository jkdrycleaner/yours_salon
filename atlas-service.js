const crypto = require('crypto');
const https = require('https');
require('dotenv').config();

const PUBLIC_KEY = process.env.ATLAS_PUBLIC_KEY;
const PRIVATE_KEY = process.env.ATLAS_PRIVATE_KEY;
const ORG_ID = process.env.ATLAS_ORG_ID;

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function parseDigestHeader(header) {
  const params = {};
  const regex = /(\w+)=["]?([^",]+)["]?/g;
  let match;
  while ((match = regex.exec(header)) !== null) {
    params[match[1]] = match[2];
  }
  return params;
}

function atlasApi(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://cloud.mongodb.com/api/atlas/v2${path}`);
    const req1 = https.request(url, {
      method,
      headers: {
        'Accept': 'application/vnd.atlas.2023-01-01+json',
        'Content-Type': 'application/json'
      }
    }, (res1) => {
      if (res1.statusCode !== 401 || !res1.headers['www-authenticate']) {
        let data = '';
        res1.on('data', chunk => data += chunk);
        res1.on('end', () => {
          try { resolve({ status: res1.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res1.statusCode, data }); }
        });
        return;
      }

      const params = parseDigestHeader(res1.headers['www-authenticate']);
      const uri = url.pathname + url.search;
      const nc = '00000001';
      const cnonce = crypto.randomBytes(8).toString('hex');
      const ha1 = md5(`${PUBLIC_KEY}:${params.realm}:${PRIVATE_KEY}`);
      const ha2 = md5(`${method}:${uri}`);
      const response = md5(`${ha1}:${params.nonce}:${nc}:${cnonce}:${params.qop || 'auth'}:${ha2}`);
      let authValue = `Digest username="${PUBLIC_KEY}", realm="${params.realm}", nonce="${params.nonce}", uri="${uri}", response="${response}", qop=${params.qop || 'auth'}, nc=${nc}, cnonce="${cnonce}"`;
      if (params.opaque) authValue += `, opaque="${params.opaque}"`;

      const req2 = https.request(url, {
        method,
        headers: {
          'Accept': 'application/vnd.atlas.2023-01-01+json',
          'Content-Type': 'application/json',
          'Authorization': authValue
        }
      }, (res2) => {
        let data = '';
        res2.on('data', chunk => data += chunk);
        res2.on('end', () => {
          try { resolve({ status: res2.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res2.statusCode, data }); }
        });
      });

      req2.on('error', reject);
      if (body) req2.write(JSON.stringify(body));
      req2.end();
    });

    req1.on('error', reject);
    req1.end();
  });
}

const atlasService = {
  atlasApi,

  async createProject(projectName) {
    const res = await atlasApi('POST', '/groups', { name: projectName, orgId: ORG_ID });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Failed to create Atlas project: ${JSON.stringify(res.data)}`);
    }
    return res.data;
  },

  async addIpAccess(groupId, ip = '0.0.0.0/0') {
    const res = await atlasApi('POST', `/groups/${groupId}/accessList`, [
      { ipAddress: ip, comment: 'Allow all for Salon SaaS' }
    ]);
    return res.data;
  },

  async createDbUser(groupId, username, password) {
    const res = await atlasApi('POST', `/groups/${groupId}/databaseUsers`, {
      databaseName: 'admin',
      roles: [{ roleName: 'readWriteAnyDatabase', databaseName: 'admin' }],
      username,
      password
    });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Failed to create db user: ${JSON.stringify(res.data)}`);
    }
    return res.data;
  },

  async createM0Cluster(groupId, clusterName) {
    const res = await atlasApi('POST', `/groups/${groupId}/clusters`, {
      name: clusterName,
      providerSettings: {
        providerName: 'TENANT',
        backingProviderName: 'AWS',
        instanceSizeName: 'M0',
        regionName: 'AP_SOUTH_1'
      }
    });
    if (res.status !== 200 && res.status !== 201 && res.status !== 202) {
      throw new Error(`Failed to create M0 cluster: ${JSON.stringify(res.data)}`);
    }
    return res.data;
  },

  async getCluster(groupId, clusterName) {
    const res = await atlasApi('GET', `/groups/${groupId}/clusters/${clusterName}`);
    return res.data;
  },

  async deleteProject(groupId) {
    const res = await atlasApi('DELETE', `/groups/${groupId}`);
    return res.data;
  },

  /**
   * Complete end-to-end dedicated cluster provisioner
   */
  async provisionDedicatedClusterForShop({ shopCode, shopName, onProgress = null }) {
    const sanitized = shopCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    const projectName = `Shop-${sanitized}`;
    const clusterName = `Clust-${sanitized}`;
    const dbUser = `usr_${sanitized}`;
    // 100% alphanumeric password (safe from URI encoding issues)
    const dbPass = 'SalonPass' + crypto.randomBytes(8).toString('hex');

    if (onProgress) onProgress('Creating isolated project on MongoDB Atlas...');
    const project = await atlasService.createProject(projectName);
    const groupId = project.id;

    try {
      if (onProgress) onProgress('Configuring IP access list (0.0.0.0/0)...');
      await atlasService.addIpAccess(groupId, '0.0.0.0/0');

      if (onProgress) onProgress('Creating dedicated database user...');
      await atlasService.createDbUser(groupId, dbUser, dbPass);

      if (onProgress) onProgress('Ordering Free M0 Cloud Cluster on AWS Mumbai (AP_SOUTH_1)...');
      await atlasService.createM0Cluster(groupId, clusterName);

      if (onProgress) onProgress('Waiting for cluster to become ready (IDLE)...');
      let ready = false;
      let srvAddress = '';
      
      for (let attempt = 1; attempt <= 40; attempt++) {
        await new Promise(r => setTimeout(r, 3000));
        const info = await atlasService.getCluster(groupId, clusterName);
        if (info.stateName === 'IDLE') {
          ready = true;
          srvAddress = info.connectionStrings?.standardSrv || '';
          break;
        }
      }

      if (!ready || !srvAddress) {
        throw new Error('Atlas cluster creation timed out after 3 minutes.');
      }

      const cleanSrv = srvAddress.replace('mongodb+srv://', '');
      const dbName = `shop_${sanitized}_db`;
      const mongoUri = `mongodb+srv://${dbUser}:${encodeURIComponent(dbPass)}@${cleanSrv}/${dbName}?retryWrites=true&w=majority`;

      return {
        success: true,
        groupId,
        projectName,
        clusterName,
        dbUser,
        srvAddress,
        dbName,
        mongoUri
      };
    } catch (err) {
      console.error('Provisioning failed, rolling back project:', err);
      try { await atlasService.deleteProject(groupId); } catch {}
      throw err;
    }
  }
};

module.exports = atlasService;
