with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

old_block = """                  <div>
                    <p class="text-white font-semibold text-sm" style="color: #ffffff !important"><a href="#founders">Founders</a></p>
                    <p class="text-slate-400 text-xs">NIE AIML</p>
                  </div>"""

new_block = """                  <div>
                    <p class="text-white font-semibold text-sm" style="color: #ffffff !important">
                      <a href="#founders" class="hover:text-primary transition-colors">Founders</a> 
                      <span class="text-slate-400 font-normal text-xs">· NIE AIML</span>
                    </p>
                  </div>"""

text = text.replace(old_block, new_block)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)