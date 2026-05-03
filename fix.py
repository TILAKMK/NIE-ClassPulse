import re
with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Rename founders-section
text = text.replace('id="founders-section"', 'id="founders"')

# 2. Update navigation links to founders
text = text.replace('href="javascript:void(0)" onclick="showSection(\'founders\')"', 'href="#founders" onclick="showSection(\'founders\')"')
text = text.replace('href="javascript:void(0)" onclick="showSection(\'founders\'); closeMobileMenu()"', 'href="#founders" onclick="showSection(\'founders\'); closeMobileMenu()"')
text = text.replace('<a id="mob-founders" onclick="showSection(\'founders\')"', '<a id="mob-founders" href="#founders" onclick="showSection(\'founders\')"')

# 3. Remove 'T' logo
t_logo = '''                  <div
                    class="size-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    T</div>'''
text = text.replace(t_logo, '')

# 4. Replace 'Team AIML' & 'Developer...' with 'Founders · NIE AIML'
old_builtby = '''                  <div>
                    <p class="text-white font-semibold text-sm" style="color: #ffffff !important">Team AIML</p>
                    <p class="text-slate-400 text-xs">Developer · NIE AIML</p>
                  </div>'''
new_builtby = '''                  <div>
                    <p class="text-white font-semibold text-sm" style="color: #ffffff !important">
                      <a href="#founders" class="hover:text-primary transition-colors">Founders</a> 
                      <span class="text-slate-400 font-normal text-xs">· NIE AIML</span>
                    </p>
                  </div>'''
text = text.replace(old_builtby, new_builtby)

# 5. Address change
text = text.replace('Manandavadi Road, Mysuru', 'Koorgalli, Mysuru')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)