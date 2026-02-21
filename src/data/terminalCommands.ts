/**
 * Common Linux/Unix commands used as fallback suggestions
 * when the ML model doesn't have enough history data.
 */
export const TERMINAL_COMMANDS: string[] = [
    // File system
    'ls', 'ls -la', 'ls -lh', 'ls -R',
    'cd', 'cd ..', 'cd ~', 'cd /',
    'pwd', 'mkdir', 'mkdir -p', 'rmdir',
    'cp', 'cp -r', 'cp -a',
    'mv', 'rm', 'rm -rf', 'rm -f',
    'touch', 'cat', 'head', 'head -n', 'tail', 'tail -f', 'tail -n',
    'less', 'more', 'wc', 'wc -l',
    'find', 'find . -name', 'find . -type f',
    'locate', 'which', 'whereis',
    'ln', 'ln -s',
    'chmod', 'chmod +x', 'chmod 755', 'chmod 644',
    'chown', 'chown -R',
    'du', 'du -sh', 'du -sh *',
    'df', 'df -h',
    'tree',

    // Text processing
    'grep', 'grep -r', 'grep -rn', 'grep -i',
    'sed', 'awk', 'sort', 'uniq', 'cut', 'tr',
    'diff', 'comm', 'xargs',

    // Archives
    'tar', 'tar -xzf', 'tar -czf', 'tar -xvf',
    'zip', 'unzip', 'gzip', 'gunzip',

    // Process management
    'ps', 'ps aux', 'ps -ef',
    'top', 'htop', 'kill', 'kill -9', 'killall',
    'bg', 'fg', 'jobs', 'nohup',
    'nice', 'renice',

    // Network
    'curl', 'curl -X POST', 'curl -s', 'curl -o',
    'wget', 'wget -q',
    'ping', 'traceroute', 'dig', 'nslookup',
    'netstat', 'netstat -tlnp', 'ss', 'ss -tlnp',
    'ifconfig', 'ip addr', 'ip route',
    'scp', 'rsync', 'rsync -avz',
    'ssh', 'telnet', 'nc',

    // System
    'systemctl status', 'systemctl start', 'systemctl stop', 'systemctl restart',
    'systemctl enable', 'systemctl disable', 'systemctl daemon-reload',
    'journalctl', 'journalctl -u', 'journalctl -f', 'journalctl --since',
    'uname', 'uname -a', 'hostname', 'uptime',
    'free', 'free -h', 'free -m',
    'lsblk', 'fdisk', 'mount', 'umount',
    'dmesg', 'lsof', 'strace',
    'whoami', 'id', 'groups',
    'su', 'sudo', 'sudo su',
    'env', 'export', 'printenv',
    'history', 'alias', 'source',
    'crontab', 'crontab -l', 'crontab -e',
    'shutdown', 'reboot',

    // Package managers
    'apt update', 'apt upgrade', 'apt install', 'apt remove', 'apt search',
    'yum install', 'yum update', 'yum search',
    'dnf install', 'dnf update',
    'pacman -S', 'pacman -Syu',
    'pip install', 'pip list', 'pip freeze',
    'npm install', 'npm run', 'npm start', 'npm run dev', 'npm run build',
    'yarn add', 'yarn install', 'yarn dev',

    // Docker
    'docker ps', 'docker ps -a',
    'docker images', 'docker pull',
    'docker run', 'docker run -d', 'docker run -it',
    'docker exec', 'docker exec -it',
    'docker logs', 'docker logs -f',
    'docker stop', 'docker start', 'docker restart',
    'docker rm', 'docker rmi',
    'docker build', 'docker build -t',
    'docker compose up', 'docker compose up -d',
    'docker compose down', 'docker compose logs',
    'docker compose ps', 'docker compose restart',
    'docker system prune', 'docker volume ls',
    'docker network ls',

    // Git
    'git status', 'git log', 'git log --oneline',
    'git add', 'git add .', 'git add -A',
    'git commit', 'git commit -m', 'git commit --amend',
    'git push', 'git push origin', 'git push -f',
    'git pull', 'git pull origin',
    'git fetch', 'git fetch --all',
    'git branch', 'git branch -a', 'git branch -d',
    'git checkout', 'git checkout -b',
    'git merge', 'git rebase', 'git rebase -i',
    'git stash', 'git stash pop', 'git stash list',
    'git diff', 'git diff --staged',
    'git reset', 'git reset --hard',
    'git clone', 'git remote', 'git remote -v',
    'git tag', 'git cherry-pick',

    // Editors
    'vim', 'vi', 'nano', 'emacs',

    // Misc
    'echo', 'printf', 'date', 'cal',
    'man', 'info', 'help',
    'clear', 'reset', 'exit', 'logout',
    'screen', 'tmux', 'tmux ls', 'tmux attach',
    'watch', 'time', 'sleep',
    'tee', 'yes', 'true', 'false',
];

/**
 * Common command sequences — when the user runs command A,
 * command B is likely to follow. Used to bootstrap the Markov model.
 */
export const COMMAND_SEQUENCES: [string, string][] = [
    // Git workflows
    ['git add .', 'git commit -m'],
    ['git add -A', 'git commit -m'],
    ['git commit -m', 'git push'],
    ['git pull', 'git status'],
    ['git stash', 'git pull'],
    ['git pull', 'git stash pop'],
    ['git checkout -b', 'git push -u origin'],

    // Docker workflows
    ['docker build -t', 'docker run'],
    ['docker compose down', 'docker compose up -d'],
    ['docker compose up -d', 'docker compose logs -f'],
    ['docker stop', 'docker rm'],

    // System admin
    ['apt update', 'apt upgrade'],
    ['systemctl daemon-reload', 'systemctl restart'],
    ['cd', 'ls'],
    ['mkdir', 'cd'],
    ['vim', 'cat'],

    // Deploy patterns
    ['npm run build', 'npm run start'],
    ['npm install', 'npm run dev'],
    ['yarn install', 'yarn dev'],
];
