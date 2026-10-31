// Diagnostic: is *.db-msk0.amvera.tech a wildcard? Which IP really listens on 5432?
const { promises: dns } = require("dns");
const net = require("net");

const HOSTS = [
  "maestria-lms-base-maestro7it.db-msk0.amvera.tech",
  "maestria-lms-maestro7it.db-msk0.amvera.tech",
  "zzz-definitely-not-created-9q7.db-msk0.amvera.tech",
];

function tcpProbe(host, port, timeout = 8000) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    let done = false;
    const finish = (r) => { if (!done) { done = true; sock.destroy(); resolve(r); } };
    sock.setTimeout(timeout);
    sock.on("connect", () => {
      // Send PostgreSQL StartupMessage and see if anything comes back.
      const body = Buffer.from("user\0probe\0database\0probe\0\0", "binary");
      const len = 8 + body.length;
      const msg = Buffer.alloc(4 + len);
      msg.writeInt32BE(len, 0);
      msg.writeInt32BE(196608, 4); // protocol 3.0
      body.copy(msg, 8);
      let got = 0;
      sock.on("data", (d) => { got += d.length; finish(`connected, ${d.length} bytes reply: ${JSON.stringify(d.slice(0, 24).toString("latin1"))}`); });
      sock.on("timeout", () => finish(`connected, NO REPLY after startup packet (got ${got} bytes)`));
      sock.on("error", (e) => finish(`connect error ${e.code}`));
      sock.write(msg);
    });
    sock.on("timeout", () => finish("TCP connect timeout"));
    sock.on("error", (e) => finish(`TCP error ${e.code}`));
  });
}

(async () => {
  for (const h of HOSTS) {
    let addrs = [];
    try { addrs = (await dns.resolve4(h)).join(","); } catch (e) { addrs = `NXDOMAIN/${e.code}`; }
    console.log(`\n${h}\n  A: ${addrs}`);
    console.log(`  5432: ${await tcpProbe(h, 5432)}`);
  }
})();
