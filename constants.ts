import type { ParanoiaLevel, SuggestedPrompt } from './types';

const allOptions = {
  updates: {
    id: 'updates',
    label: 'System Updates & Packages',
    description: 'Ensure all packages are up-to-date and remove unnecessary software.',
    prompt: '*   **System Updates & Package Management**: Ensure the system is fully up-to-date using `dnf upgrade -y`. Identify and suggest removal of common unnecessary services or packages (e.g., telnet-server, rsh-server). After updates, clean the DNF cache using `dnf clean all`.',
  },
  firewall: {
    id: 'firewall',
    label: 'Firewall Configuration',
    description: 'Set up firewalld with a default-deny policy and allow essential services.',
    prompt: '*   **Firewall Configuration**: Configure `firewalld`. Set the default zone to public, with a default-deny policy for incoming traffic. Add rules to allow SSH (on a non-standard port if specified) and other essential services.',
  },
  ssh: {
    id: 'ssh',
    label: 'SSH Hardening',
    description: 'Secure the SSH daemon by disabling root login and enforcing key-based auth.',
    prompt: '*   **SSH Hardening**: Secure `/etc/ssh/sshd_config`. The script should programmatically (e.g., using `sed`) disable root login (`PermitRootLogin no`), disable password authentication (`PasswordAuthentication no`), and enable key-based authentication (`PubkeyAuthentication yes`). Warn the user to have a key in place before running.',
  },
  fail2ban: {
    id: 'fail2ban',
    label: 'Fail2Ban Intrusion Prevention',
    description: 'Install and configure Fail2Ban to block brute-force attacks on SSH.',
    prompt: `*   **Fail2Ban Intrusion Prevention**: Install the \`fail2ban\` package. Create a configuration file at \`/etc/fail2ban/jail.local\` to override the defaults and prevent changes from being overwritten by package updates. Populate this file with a \`[sshd]\` section, setting \`enabled = true\`, a \`bantime\` of \`1h\`, a \`findtime\` of \`10m\`, and a \`maxretry\` of \`3\`. After creating the file, enable and start the \`fail2ban\` service via \`systemctl\`. Add comments to the script explaining how a user can customize these values.`,
  },
  passwordPolicy: {
      id: 'passwordPolicy',
      label: 'Enforce Strong Password Policies',
      description: 'Configure /etc/security/pwquality.conf to enforce password complexity.',
      prompt: '*   **Enforce Strong Password Policies**: Modify `/etc/security/pwquality.conf` using `sed` or `awk` to set strong password requirements. Include `minlen = 14`, `dcredit = -1` (at least one digit), `ucredit = -1` (at least one uppercase), `ocredit = -1` (at least one special char), `lcredit = -1` (at least one lowercase). Explain each setting in comments.',
  },
  userAccountManagement: {
      id: 'userAccountManagement',
      label: 'User Account Management',
      description: 'Add a placeholder for a new admin user and lock inactive accounts.',
      prompt: '*   **User Account Management**: Define a placeholder variable `NEW_ADMIN_USER="your_admin"`. The script will check if this user exists. If not, it will create this user (`useradd -m -s /bin/bash $NEW_ADMIN_USER`), add them to the `wheel` group for sudo access (`usermod -aG wheel $NEW_ADMIN_USER`), and set an account expiration date 90 days from creation using `chage`. The script should also include a function to find and lock any user accounts (excluding system accounts with UID < 1000) that have been inactive for over 35 days.',
  },
  sudoAudit: {
      id: 'sudoAudit',
      label: 'Audit Sudo Privileges',
      description: 'Check /etc/sudoers and /etc/sudoers.d/ for insecure configurations.',
      prompt: '*   **Audit Sudo Privileges**: The script should check for insecure sudo configurations by scanning `/etc/sudoers` and files in `/etc/sudoers.d/`. Specifically, it should report any users or groups with `NOPASSWD` privileges and any entries for the `ALL` keyword. The findings should be logged with `log_warning`.',
  },
  kernel: {
    id: 'kernel',
    label: 'Kernel Hardening (sysctl)',
    description: 'Apply security-focused kernel parameter tuning via sysctl.',
    prompt: '*   **Kernel Hardening (sysctl)**: Apply security-related kernel parameters by creating a configuration file in `/etc/sysctl.d/`. Include settings to prevent IP spoofing, mitigate SYN flood attacks, and harden network parameters.',
    rebootRequired: true,
  },
  filesystem: {
    id: 'filesystem',
    label: 'Secure Filesystem Mounts',
    description: 'Secure shared memory and temporary directories; find insecure permissions.',
    prompt: '*   **Filesystem & Permissions**: Secure `/tmp` and `/var/tmp` by mounting them with `noexec`, `nosuid`, and `nodev` options. Secure shared memory (`/dev/shm`). Find and report world-writable files and directories.',
    rebootRequired: true,
  },
  logging: {
    id: 'logging',
    label: 'Logging & Auditing Setup (auditd)',
    description: 'Configure and enable the auditd service with a baseline ruleset.',
    prompt: '*   **Logging & Auditing Setup**: Ensure the `audit` package is installed. Start and enable the `auditd` service. Create a baseline ruleset in `/etc/audit/rules.d/00-base.rules` that sets the buffer size, enables the daemon, and sets the failure mode to panic. After adding any specific rules files, the script must run `augenrules --load` to apply them.',
  },
  auditFileAccess: {
    id: 'auditFileAccess',
    label: 'Monitor Critical File Access',
    description: 'Set auditd rules to watch for changes to sensitive files like /etc/passwd.',
    prompt: '*   **Audit Critical File Access**: Generate auditd rules to monitor read, write, and attribute change access to critical system files. Include rules for `/etc/passwd`, `/etc/shadow`, `/etc/group`, `/etc/gshadow`, `/etc/sudoers`, and `/etc/selinux/semanage.conf`. The rules should be written to `/etc/audit/rules.d/50-file-access.rules`.',
  },
  auditCommands: {
    id: 'auditCommands',
    label: 'Monitor Privileged Commands',
    description: 'Log the execution of commands that can alter system security.',
    prompt: '*   **Audit Privileged Commands**: Generate auditd rules to monitor the execution of commands that can affect system security. Track `setuid` and `setgid` programs and specifically watch for the execution of `/usr/bin/sudo`, `/usr/bin/mount`, `/usr/bin/chown`, and `/usr/bin/chmod`. The rules should be written to `/etc/audit/rules.d/51-commands.rules`.',
  },
  auditLogins: {
    id: 'auditLogins',
    label: 'Monitor Login Attempts',
    description: 'Audit all login events, session creations, and failed login attempts.',
    prompt: '*   **Audit Login Attempts**: Generate auditd rules to create a log trail for all login events. Monitor the files `/var/log/faillog`, `/var/log/lastlog`, and `/var/log/tallylog`. Also, audit syscalls related to session creation like `setsid`. The rules should be written to `/etc/audit/rules.d/52-logins.rules`.',
  },
  selinux: {
    id: 'selinux',
    label: 'SELinux Configuration',
    description: 'Ensure SELinux is set to enforcing mode.',
    prompt: '*   **SELinux Configuration**: Ensure SELinux is enabled and running in `enforcing` mode. Modify `/etc/selinux/config` programmatically (e.g., using `sed`) to set `SELINUX=enforcing`. Add comments explaining how to check SELinux status (`sestatus`) and temporarily set modes (`setenforce 1`).',
    rebootRequired: true,
  },
  sshPort: {
    id: 'sshPort',
    label: 'Change Default SSH Port',
    description: 'Move SSH to a non-standard port to reduce exposure to automated attacks.',
    prompt: '*   **Change SSH Port**: The script should define a variable `NEW_SSH_PORT` and set it to a non-standard port (e.g., 2222). It must then programmatically modify `/etc/ssh/sshd_config` to change the listening port to this new value. After updating the config, the script MUST also update both the firewall and SELinux policy to allow the new port. Use `firewall-cmd --permanent --add-port=$NEW_SSH_PORT/tcp` and `semanage port -a -t ssh_port_t -p tcp $NEW_SSH_PORT`. Check if the `policycoreutils-python-utils` package (which provides `semanage`) is installed first. The script must reload both `firewalld` and `sshd` services to apply all changes. Add comments explaining each step.',
  },
  umask: {
    id: 'umask',
    label: 'Enforce Stricter Umask',
    description: 'Set a more secure default umask (e.g., 027) for new users to limit default file permissions.',
    prompt: '*   **Stricter Umask**: Configure a stricter default umask of `027` for all users to ensure new files and directories are not world-readable by default. Modify both `/etc/bashrc` and `/etc/profile` to set the umask.',
  },
  autoUpdates: {
    id: 'autoUpdates',
    label: 'Enable Automatic Security Updates',
    description: 'Install and configure dnf-automatic to apply security updates daily.',
    prompt: '*   **Automatic Security Updates**: Install the `dnf-automatic` package. Configure it by modifying `/etc/dnf/automatic.conf`. Set `upgrade_type = security` and `apply_updates = yes`. Enable and start the `dnf-automatic.timer` systemd unit.',
  },
  disableFilesystems: {
    id: 'disableFilesystems',
    label: 'Disable Unused Filesystems',
    description: 'Prevent loading of uncommon filesystems to reduce kernel attack surface.',
    prompt: '*   **Disable Unused Filesystems**: Create a file in `/etc/modprobe.d/` to prevent the loading of uncommon filesystems. Add `install <filesystem_name> /bin/true` for filesystems like `cramfs`, `freevxfs`, `jffs2`, `hfs`, `hfsplus`, `squashfs`, and `udf`.',
    rebootRequired: true,
  },
  bindCheck: {
    id: 'bindCheck',
    label: 'Check for BIND Vulnerabilities',
    description: 'Suggests updating BIND if it\'s installed and vulnerable to known exploits.',
    prompt: '*   **BIND Vulnerability Check**: The script will check if the `bind` package is installed. If it is, it will use `named -v` to get the version and display it to the user with a warning to check for CVEs. It will also use `dnf --security check-update bind` to see if there are pending security updates for the package and recommend the user to run `dnf upgrade bind` if any are found.',
  },
  grubPassword: {
    id: 'grubPassword',
    label: 'Set GRUB Bootloader Password',
    description: 'Protects the GRUB bootloader with a password to prevent unauthorized boot changes.',
    prompt: '*   **Set GRUB Password**: Protects the bootloader menu. The script will first generate a secure, random 16-character alphanumeric password. It will log this password to the screen and to the log file, with a strong warning for the user to save it immediately. Then, it will generate a PBKDF2 hash of that password using `grub2-mkpasswd-pbdf2`. It will then create a custom GRUB settings file at `/etc/grub.d/01_users` and programmatically add a superuser (`set superusers="root"`) and the hashed password (`password_pbkdf2 root HASH_FROM_PREVIOUS_STEP`). It must then make this file executable and readable only by root (`chmod 700 /etc/grub.d/01_users`). Finally, it should regenerate the main `grub.cfg` file by detecting the correct location (UEFI vs BIOS) and running `grub2-mkconfig` with the correct output path. Add very prominent, multi-line comments explaining that the generated password is critical and losing it will require boot media to recover the system.',
    rebootRequired: true,
  },
  iptablesAdvanced: {
    id: 'iptablesAdvanced',
    label: 'Advanced IPtables Ruleset',
    description: 'Configure a stateful firewall, log dropped packets, and mitigate common stealth scans.',
    prompt: '*   **Advanced IPtables Ruleset**: The script must generate a secure, stateful firewall ruleset using `iptables`. First, it should flush all existing rules (`iptables -F`), delete all chains (`iptables -X`), and zero all counters (`iptables -Z`). It should then set default policies to `DROP` for the `INPUT` and `FORWARD` chains, and `ACCEPT` for the `OUTPUT` chain. The rules should: allow loopback traffic; allow established and related incoming connections (`-m conntrack --ctstate ESTABLISHED,RELATED`); log and drop common stealth scans (NULL, FIN, XMAS); log and drop invalid packets; and rate-limit new SSH connection attempts to 3 per minute to prevent brute-force attacks. After all rules are added, use `iptables-save` to persist them.',
  },
  iptablesBogon: {
    id: 'iptablesBogon',
    label: 'Block Bogon Networks',
    description: 'Drop traffic from unroutable and unallocated "bogon" IP address spaces.',
    prompt: '*   **Block Bogon Networks**: The script should add `iptables` rules to the `INPUT` chain to drop all packets from known unroutable and unallocated "bogon" IP address spaces. This includes ranges like `0.0.0.0/8`, `10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`, etc. Add comments explaining what bogon networks are.',
  },
  iptablesPortKnocking: {
    id: 'iptablesPortKnocking',
    label: 'Enable Port Knocking for SSH',
    description: 'Hide the SSH port, opening it only after a secret sequence of connection "knocks".',
    prompt: '*   **Enable Port Knocking for SSH**: This is an advanced feature. The script should use `iptables` to set up a port knocking sequence for SSH. First, ensure the main SSH rule is REMOVED from the INPUT chain. Then, create three new chains (e.g., `KNOCK1`, `KNOCK2`, `SSH_GATE`). A new connection to a secret port (e.g., 7001) should move the source IP to the `KNOCK1` list. A subsequent connection from that IP to a second secret port (e.g., 7002) moves them to `KNOCK2`. A final knock on a third port (e.g., 7003) moves them to `SSH_GATE`, which contains the rule to `ACCEPT` traffic on the real SSH port. The user\'s IP is tracked via the `recent` module. IPs are remembered for only 15 seconds in each stage. Add extensive comments explaining how to use this (e.g., `knock server 7001 7002 7003`) and how to change the ports.',
  },
  dnfSecurity: {
    id: 'dnfSecurity',
    label: 'Secure DNF Configuration',
    description: 'Enforce GPG checks for all packages and audit repository configurations.',
    prompt: '*   **Secure DNF Configuration**: The script must ensure that GPG signature checking is globally enabled. Programmatically verify and set `gpgcheck=1` in the `[main]` section of `/etc/dnf/dnf.conf`. Additionally, the script should scan all `.repo` files in `/etc/yum.repos.d/` and use `log_warning` to report any repositories that are configured with `gpgcheck=0`, as this is a major security risk. It should also list any disabled repositories (`enabled=0`) for user review. Add comments explaining the importance of these settings.',
  },
  pciDss: {
    id: 'pciDss',
    label: 'PCI DSS Baseline Checks',
    description: 'Install and configure tools to meet common PCI DSS requirements like File Integrity Monitoring (AIDE) and log retention.',
    prompt: `*   **PCI DSS Baseline Checks**: This section implements several controls related to the Payment Card Industry Data Security Standard.
*   **File Integrity Monitoring (Req 11.5)**: Install the \`aide\` package. Initialize the AIDE database using \`aide --init\` and then move the new database to become the active one (\`mv /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz\`). Add comments explaining that the initial database must be stored securely. Create a cron job in \`/etc/cron.daily/aidecheck\` to run \`aide --check\` and log the results.
*   **Log Retention (Req 10.7)**: Configure system logs to be persistent and retained. Modify \`/etc/systemd/journald.conf\` to set \`Storage=persistent\` and \`SystemMaxUse=500M\` to prevent excessive disk usage. The script should then restart the \`systemd-journald\` service.
*   **Disable Unnecessary Services (Req 2.2.2)**: Systematically disable services that are insecure or typically not required in a PCI environment, such as \`telnet.socket\`, \`rsh.socket\`, \`nfs-server\`, and \`samba\`. Use \`systemctl disable --now\` for each.
*   **Password History & Lockout (Req 8.2.3, 8.1.6)**: Enhance password security. Check PAM configuration files in \`/etc/pam.d/\` (like \`password-auth\` and \`system-auth\`) to ensure \`pam_pwhistory.so\` is used to remember at least the last 5 passwords, and \`pam_tally2.so\` is configured to lock an account for 15 minutes after 5 failed login attempts.`,
  },
};

// --- Parent Container Definitions ---

const systemAndPackagesParent = {
    id: 'systemAndPackages',
    label: 'System & Package Management',
    description: 'Core system updates and package manager configuration.',
    prompt: '',
    subOptions: [allOptions.updates, allOptions.autoUpdates, allOptions.dnfSecurity]
};

const networkSecurityParent = {
    id: 'networkSecurity',
    label: 'Network Security',
    description: 'Harden network services like SSH and the system firewall.',
    prompt: '',
    subOptions: [allOptions.firewall, allOptions.ssh, allOptions.sshPort, allOptions.fail2ban]
};

const userManagementParent = {
    id: 'userManagement',
    label: 'User & Access Control',
    description: 'Manage user accounts, enforce strong passwords, and set restrictive permissions.',
    prompt: '',
    subOptions: [
        allOptions.passwordPolicy,
        allOptions.userAccountManagement,
        allOptions.sudoAudit,
        allOptions.umask,
    ]
};

const systemInternalsParent = {
    id: 'systemInternals',
    label: 'System Internals',
    description: 'Harden low-level system components like the kernel and SELinux.',
    prompt: '',
    subOptions: [allOptions.kernel, allOptions.selinux]
};

const serviceHardeningParent = {
    id: 'serviceHardening',
    label: 'Service-Specific Hardening',
    description: 'Check for vulnerabilities in specific installed services.',
    prompt: '',
    subOptions: [allOptions.bindCheck]
};

const iptablesParent = {
    id: 'iptables',
    label: 'Advanced Firewall (iptables)',
    description: 'Implement a highly secure, layered firewall using advanced iptables features.',
    prompt: '',
    subOptions: [
        allOptions.iptablesAdvanced,
        allOptions.iptablesBogon,
        allOptions.iptablesPortKnocking,
    ],
};

const loggingParent = {
    id: 'loggingParent',
    label: 'Auditing & Logging',
    description: 'Configure detailed system logging and auditing to track security events.',
    prompt: '',
    subOptions: [
        allOptions.logging,
        allOptions.auditFileAccess,
        allOptions.auditCommands,
        allOptions.auditLogins
    ]
};

const bootAndFilesystemParent = {
    id: 'bootAndFilesystem',
    label: 'Boot & Filesystem Security',
    description: 'Secure the boot process and harden filesystem configurations.',
    prompt: '',
    subOptions: [allOptions.grubPassword, allOptions.filesystem, allOptions.disableFilesystems]
};

const complianceParent = {
    id: 'compliance',
    label: 'Compliance Frameworks',
    description: 'Apply configurations based on common security standards like PCI DSS.',
    prompt: '',
    subOptions: [allOptions.pciDss]
};


export const PARANOIA_LEVELS: ParanoiaLevel[] = [
  {
    level: 1,
    title: 'Level 1: Essential Hardening',
    description: 'Recommended for all systems. These are fundamental security practices with low risk of impacting system functionality.',
    options: [
        { ...systemAndPackagesParent, subOptions: [allOptions.updates] },
        { ...networkSecurityParent, subOptions: [allOptions.firewall, allOptions.ssh, allOptions.sshPort] },
    ],
  },
  {
    level: 2,
    title: 'Level 2: Advanced Security',
    description: 'For production servers and systems handling sensitive data. These measures offer enhanced protection but may require some configuration.',
    options: [
        { ...systemAndPackagesParent, subOptions: [allOptions.autoUpdates, allOptions.dnfSecurity] },
        { ...networkSecurityParent, subOptions: [allOptions.fail2ban] },
        userManagementParent,
        systemInternalsParent,
        serviceHardeningParent
    ],
  },
  {
    level: 3,
    title: 'Level 3: Maximum Security ("Paranoid Mode")',
    description: 'For high-risk environments where security is paramount. These settings may affect usability or application compatibility.',
    options: [
        iptablesParent,
        bootAndFilesystemParent,
        loggingParent,
        complianceParent,
    ],
  }
];


export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
    {
        label: 'CVE-2021-3156 (Baron Samedit)',
        promptText: 'Add a check for the sudo Baron Samedit vulnerability (CVE-2021-3156) and recommend updating if vulnerable.',
    },
    {
        label: 'CVE-2014-6271 (Shellshock)',
        promptText: 'Add a command to test if the system\'s bash executable is vulnerable to the Shellshock bug (CVE-2014-6271).',
    },
    {
        label: 'CVE-2021-44228 (Log4Shell)',
        promptText: 'Include a section that scans the filesystem for vulnerable Log4j library versions (log4j-core*.jar) related to CVE-2021-44228.',
    },
    {
        label: 'CVE-2016-5195 (Dirty COW)',
        promptText: 'Add a check for the Dirty COW vulnerability (CVE-2016-5195) by verifying the kernel version is patched. The script should not attempt to compile and run an exploit.',
    },
    {
        label: 'CVE-2021-4034 (PwnKit)',
        promptText: 'Add a check for the PwnKit vulnerability (CVE-2021-4034) by checking the installed version of the `polkit` package and recommending an update if it is vulnerable.',
    },
    {
        label: 'CVE-2014-0160 (Heartbleed)',
        promptText: 'Add a check for the Heartbleed vulnerability (CVE-2014-0160) by checking the installed version of `openssl` and recommending an update if vulnerable.',
    },
    {
        label: 'Create Auditor User',
        promptText: 'Create a new user named "auditor" with a locked password, a home directory, and add them to a new group also named "auditor". This user should not have shell access.',
    },
    {
        label: 'Minimal Services',
        promptText: 'Disable all non-essential services. Ensure core services like sshd, crond, auditd, and firewalld remain enabled.',
    },
    {
        label: 'Weekly Update Check',
        promptText: 'Add a weekly cron job in /etc/cron.weekly/ that runs `dnf check-update` and logs the output to /var/log/weekly_update_check.log.',
    },
];


export const JOKES: string[] = [
    // Hacker & Security
    "Why don't hackers get cold? They're always close to a window.",
    "Why was the firewall so sad? It had too many rejections.",
    "What's a hacker's favorite season? Phishing season.",
    "Why did the security consultant get fired? He kept giving root-level access to his plants.",
    "I have a new password: 'incorrect'. So when I forget it, my computer tells me 'Your password is incorrect.'",
    "A sudo walks into a bar, but the bartender says, 'Sorry, you're not allowed in here.' The sudo replies, 'That's okay, I'll just let myself in.'",

    // Computer & OS & Linux
    "A SQL query walks into a bar, walks up to two tables and asks, 'Can I join you?'",
    "How many programmers does it take to change a light bulb? None, that's a hardware problem.",
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "I told my computer I needed a break, and now it won’t stop sending me Kit-Kat ads.",
    "There are 10 types of people in the world: those who understand binary, and those who don't.",
    "Why did the Linux penguin cross the road? To prove it wasn't just a kernel.",
    "What's the best thing about UDP jokes? I don't care if you get them.",
    "To understand what recursion is, you must first understand recursion.",

    // Duck
    "What's a duck's favorite programming language? Python, because it's good for web-bed development.",
    "What do you call a duck that steals? A robber ducky.",
    "Why did the duck get a ticket? He was caught speeding in a web-footed zone.",
    "Why do ducks have feathers? To cover their butt quacks.",
    "What's a duck's favorite snack? Cheese and quackers.",
    "What did the duck say when he bought lipstick? 'Put it on my bill.'",
];
