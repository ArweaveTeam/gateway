# Transaction Manifests

Transaction manifests are only usable with a valid domain. Please make sure to have a valid domain with wildcard SSL enabled. You can use Let's Encrypt to configure a domain accordingly.

In order to effectively use manifests. You need to have domain wildcards pointing to your domain.

### Configuring Manifests

In order to configure manifests, you need to change the `MANIFEST_PREFIX` environment variable. It should just be your domain name. Simply change it from:

```conf
MANIFEST_PREFIX=amp-gw.online
```

to

```conf
MANIFEST_PREFIX=my-actual.domain
```

Once configured and the Gateway points to the same domain. It should be good to go.

## Manifests for Development

Using transaction manifests is a bit more complicated while developing. Since it involves using `dnsmasq` and modifying your network manager. Assuming you're working with Ubuntu. Follow these steps to enable a Transaction Manifest development environment.

### Setup DNSMasq

First install `dnsmasq`:

```bash
sudo apt-get install dnsmasq -y
```

Then enable `dnsmasq` in `NetworkManager`:

```conf
[main]
plugins=ifupdown,keyfile
dns=dnsmasq

[ifupdown]
managed=false

[device]
wifi.scan-rand-mac-address=no
```

And make sure `/etc/resolv.conf` points to `NetworkManager`:

```bash
sudo rm /etc/resolv.conf
sudo ln -s /var/run/NetworkManager/resolv.conf /etc/resolv.conf
```

Make sure that `/var/run/NetworkManager/resolv.conf` has a nameserver of `127.0.1.1`:

```conf
search lan
nameserver 127.0.1.1
```

### Configure a test domain

In this example. We use `amplify.testing` as the url. Create a new `config` url.

```bash
/etc/NetworkManager/dnsmasq.d/amplify.testing.conf
```

In this config file append the following.

```conf
address=/amplify.testing/127.0.0.1
```

Restart the network manager and you should be good to go!

```bash
sudo systemctl reload NetworkManager
```

### Testing your local domain.

Confirm you can test your local domain by going to:

```bash
http://amplify.testing/
```

If it returns the Gateway server's generic output. You should be good to go!