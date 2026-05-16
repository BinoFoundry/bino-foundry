const fs = require('fs');

['src/components/CircularStrand.tsx', 'src/components/SortableCircularStrand.tsx'].forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Remove if (bead.type === "spacer" && bead.spacer) ... etc
    content = content.replace(/if \\(bead\\.type === "spacer"[\\s\\S]*?if \\(bead\\.type === "charm"[\\s\\S]*?\\}/, '');
    
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Cleaned string matching logic in ${filePath}`);
});
