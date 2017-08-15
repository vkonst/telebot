#
# Ientities and other common params for ssh tunnel scripts

HOMEDIR="/data/data/com.termux/files/home"
BINDIR="/data/data/com.termux/files/usr/bin"

IDENTITY="<path_to_your_key>"           # ex. "~/.ssh/aws_key_rsa"
REMOTEHOST="<your_server_alias>"        # ex.: "telebot.ddns.net"
REMOTEID="<your_user>"                  # ex.: "mybot"
REMOTE_SSHD_PORT="<your_sshd_port>"     # ex: '22'
HTTP_PORT="<your_http_port>"		    # ex: '3000'

LOGGER="$BINDIR/tee -a $HOMEDIR/autossh.log"
NETSTAT="$BINDIR/applets/netstat -t"

# pattern to detect established tunnel connection
# example usage:
# IS_CONNECTED="${NETSTAT} | grep -E \"${CONNECTION_PATTERN}\:${HTTP_PORT}\s+ESTABLISHED\""
#
CONNECTION_PATTERN="<your_url_pattern>" # ex.: "\\.amazonaws\\.com"

