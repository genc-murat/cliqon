with open('src/services/sftp.rs') as f:
    lines = f.readlines()
brace_c = 0
paren_c = 0
for i, l in enumerate(lines, 1):
    brace_c += l.count('{') - l.count('}')
    paren_c += l.count('(') - l.count(')')
    if brace_c < 0 or paren_c < 0:
        print(f"Negative at {i}: brace={brace_c} paren={paren_c}")
