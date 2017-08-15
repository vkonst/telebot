#!/data/data/com.termux/files/usr/bin/sh
# Script to start up tunnel with autossh.

HOMEDIR="/data/data/com.termux/files/home"
. ${HOMEDIR}/scripts/lib_tunnel.sh

FORWARDED_SSH_PORT='0.0.0.0:8022'
LOCAL_SSH_PORT='8022'
SSH_OPTIONS="-R 0.0.0.0:${HTTP_PORT}:localhost:${HTTP_PORT} -o ServerAliveInterval=10 -o ConnectTimeout=60 -o HostKeyAlias=${REMOTEHOST}"

IS_CONNECTED="${NETSTAT} | grep -E \"${CONNECTION_PATTERN}\:ssh\s+ESTABLISHED\""

AUTOSSH_POLL=600
AUTOSSH_PORT=20075
AUTOSSH_GATETIME=30
AUTOSSH_DEBUG='yes'
AUTOSSH_PATH="$BINDIR/ssh"

# check if autossh is running, restart if not

if pidof autossh > /dev/null 2>&1; then
        # autossh is running

        $IS_CONNECTED  > /dev/null 2>&1
        if [ "$?" -eq "0" ]; then
        # connection established
                 RESULT="ESTABLISHED"
        else
                RESULT="DOWN"
        fi
        echo "`date` autossh is running. connection is $RESULT" | $LOGGER

else
        echo -n "autossh is not running. " |  $LOGGER
        export AUTOSSH_POLL AUTOSSH_DEBUG AUTOSSH_PATH AUTOSSH_GATETIME AUTOSSH_PORT

        $BINDIR/autossh $REMOTEID@$REMOTEHOST \
                        -p $REMOTE_SSHD_PORT -i $IDENTITY \
                        -R $FORWARDED_SSH_PORT:localhost:$LOCAL_SSH_PORT \
                        -Ngf $SSH_OPTIONS

        # connection established?
        sleep 10
        $IS_CONNECTED > /dev/null 2>&1
        if [ "$?" -eq "0" ]; then
                RESULT="ESTABLISHED"
        else
                RESULT="DOWN"
        fi
        echo "`date` autossh restarted. connection is $RESULT." | $LOGGER
fi
