import base64

b64 = open('C:/Users/DiepPC/Desktop/Studio-Font-Manager/logo_b64.txt').read().strip()
data_uri = f'data:image/png;base64,{b64}'
html_path = 'C:/Users/DiepPC/Desktop/Studio-Font-Manager/public/index.html'
content = open(html_path, 'r', encoding='utf-8').read()

# Add favicon in <head>
favicon_tag = f'<link rel="icon" type="image/png" href="{data_uri}" />'
if '<link rel="icon"' not in content:
    content = content.replace('<head>', f'<head>\n  {favicon_tag}')

# Replace img src in header
content = content.replace('<img src="/logo.png" alt="Logo"', f'<img src="{data_uri}" alt="Logo"')

open(html_path, 'w', encoding='utf-8').write(content)
print('Updated index.html with inline logo data URI and favicon!')
