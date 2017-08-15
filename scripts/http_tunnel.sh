#!/data/data/com.termux/files/usr/bin/sh
# Script to start up HTTP tunnel over ssh.

HOMEDIR="/data/data/com.termux/files/home"
. ${HOMEDIR}/scripts/lib_tunnel.sh

IS_CONNECTED="${NETSTAT} | grep -E \"${CONNECTION_PATTERN}\:${HTTP_PORT}\s+ESTABLISHED\""

$IS_CONNECTED  > /dev/null 2>&1
if [ "$?" -eq "0" ]; then
  # connection established
  echo "`date` http tunnel is ESTABLISHED"

else
  echo "`date` http tunnel is DOWN. Restrting ..."

  $BINDIR/ssh "${REMOTEID}@${REMOTEHOST}" -p ${REMOTE_SSHD_PORT} \
              -i "${IDENTITY}" -oHostKeyAlias="${REMOTEHOST}" \
              -R 0.0.0.0:${HTTP_PORT}:localhost:${HTTP_PORT} -Ng

  sleep 10

  $IS_CONNECTED  > /dev/null 2>&1
  if [ "$?" -eq "0" ]; then
    echo "`date` http tunnel has been ESTABLISHED"
  else
    echo "`date` http tunnel restart has failed."
  fi
fi
