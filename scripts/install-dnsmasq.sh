brew install dnsmasq
mkdir -pv $(brew --prefix)/etc/
echo 'address=/.localhost/127.0.0.1' > $(brew --prefix)/etc/dnsmasq.conf
echo 'port=53' >> $(brew --prefix)/etc/dnsmasq.conf
sudo mkdir -v /etc/resolver
sudo bash -c 'echo "nameserver 127.0.0.1" > /etc/resolver/localhost'
sudo brew services start dnsmasq