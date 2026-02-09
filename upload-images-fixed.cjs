const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION - YOU MUST EDIT THESE VALUES
// ============================================================================

const SUPABASE_URL = 'https://vfudcvosdmzljtzxkjmo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_oM8iUO5g6wpHvzYkQ9R-TQ_8emtzXKi';

const LOWRES_FOLDER = 'C:\\FishApp\\Images\\lowres';
const HIGHRES_FOLDER = 'C:\\FishApp\\Images\\highres';

// ============================================================================
// DON'T EDIT BELOW THIS LINE
// ============================================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Extract catalogue name from filename
function extractCatalogueName(filename) {
  try {
    const withoutExt = filename.replace('.webp', '');
    const parts = withoutExt.split(' ');
    
    if (!parts || parts.length === 0) return '';
    
    let catalogueParts = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      
      // Check if next part looks like scientific name (lowercase start)
      if (i < parts.length - 1 && 
          part.length > 0 &&
          part[0] === part[0].toUpperCase() && 
          parts[i + 1] &&
          parts[i + 1].length > 0 &&
          parts[i + 1][0] === parts[i + 1][0].toLowerCase()) {
        break;
      }
      
      catalogueParts.push(part);
    }
    
    return catalogueParts.join(' ').trim();
  } catch (error) {
    console.error(`\nError parsing: ${filename}`);
    return '';
  }
}

// Upload file with retry logic
async function uploadFile(localPath, storagePath) {
  try {
    const fileBuffer = fs.readFileSync(localPath);
    
    const { data, error } = await supabase.storage
      .from('fish-images')
      .upload(storagePath, fileBuffer, {
        contentType: 'image/webp',
        upsert: true
      });
    
    if (error) throw error;
    
    const { data: urlData } = supabase.storage
      .from('fish-images')
      .getPublicUrl(storagePath);
    
    return urlData.publicUrl;
  } catch (error) {
    return null;
  }
}

async function uploadImages() {
  console.log('🚀 Starting image upload process...\n');
  
  if (!fs.existsSync(LOWRES_FOLDER)) {
    console.error(`❌ Lowres folder not found: ${LOWRES_FOLDER}`);
    return;
  }
  
  if (!fs.existsSync(HIGHRES_FOLDER)) {
    console.error(`❌ Highres folder not found: ${HIGHRES_FOLDER}`);
    return;
  }
  
  console.log('📊 Fetching species from database...');
  const { data: species, error: speciesError } = await supabase
    .from('species')
    .select('id, catalogue_name, common_name');
  
  if (speciesError) {
    console.error('❌ Error fetching species:', speciesError);
    return;
  }
  
  console.log(`✅ Found ${species.length} species in database\n`);
  
  console.log('📁 Reading lowres images...');
  const lowresFiles = fs.readdirSync(LOWRES_FOLDER).filter(f => f.endsWith('.webp'));
  console.log(`✅ Found ${lowresFiles.length} lowres images\n`);
  
  console.log('📁 Reading highres images...');
  const highresFiles = fs.readdirSync(HIGHRES_FOLDER).filter(f => f.endsWith('.webp'));
  console.log(`✅ Found ${highresFiles.length} highres images\n`);
  
  console.log('⬆️  Uploading lowres images...\n');
  let lowresCount = 0;
  let lowresMatched = 0;
  let lowresSkipped = 0;
  
  for (const filename of lowresFiles) {
    lowresCount++;
    
    try {
      const catalogueName = extractCatalogueName(filename);
      
      process.stdout.write(`\r[${lowresCount}/${lowresFiles.length}] ${filename.substring(0, 60).padEnd(60)}  `);
      
      if (!catalogueName) {
        lowresSkipped++;
        continue;
      }
      
      const matchingSpecies = species.find(s => 
        s.catalogue_name && 
        catalogueName &&
        s.catalogue_name.toLowerCase() === catalogueName.toLowerCase()
      );
      
      if (!matchingSpecies) {
        lowresSkipped++;
        continue;
      }
      
      const localPath = path.join(LOWRES_FOLDER, filename);
      const storagePath = `lowres/${filename}`;
      const publicUrl = await uploadFile(localPath, storagePath);
      
      if (publicUrl) {
        const { error: updateError } = await supabase
          .from('species')
          .update({ lowres_image_url: publicUrl })
          .eq('id', matchingSpecies.id);
        
        if (!updateError) {
          lowresMatched++;
        }
      }
    } catch (error) {
      console.log(`\n⚠️  Error with ${filename}: ${error.message}`);
      lowresSkipped++;
    }
  }
  
  console.log(`\n\n✅ Lowres: ${lowresMatched} uploaded, ${lowresSkipped} skipped\n`);
  
  console.log('⬆️  Uploading highres images...\n');
  let highresCount = 0;
  const speciesHighresMap = {};
  
  for (const filename of highresFiles) {
    highresCount++;
    
    try {
      const catalogueName = extractCatalogueName(filename);
      
      process.stdout.write(`\r[${highresCount}/${highresFiles.length}] ${filename.substring(0, 60).padEnd(60)}  `);
      
      if (!catalogueName) continue;
      
      const matchingSpecies = species.find(s => 
        s.catalogue_name && 
        catalogueName &&
        s.catalogue_name.toLowerCase() === catalogueName.toLowerCase()
      );
      
      if (!matchingSpecies) continue;
      
      const localPath = path.join(HIGHRES_FOLDER, filename);
      const storagePath = `highres/${filename}`;
      const publicUrl = await uploadFile(localPath, storagePath);
      
      if (publicUrl) {
        if (!speciesHighresMap[matchingSpecies.id]) {
          speciesHighresMap[matchingSpecies.id] = [];
        }
        speciesHighresMap[matchingSpecies.id].push(publicUrl);
      }
    } catch (error) {
      // Skip silently
    }
  }
  
  console.log(`\n\n✅ Highres upload complete\n`);
  
  console.log('💾 Updating database with highres arrays...\n');
  let highresUpdated = 0;
  
  for (const [speciesId, urls] of Object.entries(speciesHighresMap)) {
    const { error: updateError } = await supabase
      .from('species')
      .update({ highres_image_urls: urls })
      .eq('id', speciesId);
    
    if (!updateError) {
      highresUpdated++;
    }
  }
  
  console.log(`✅ Updated ${highresUpdated} species with highres\n`);
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 UPLOAD COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Lowres uploaded: ${lowresMatched}/${lowresFiles.length}`);
  console.log(`Highres groups: ${highresUpdated}`);
  console.log(`Total highres: ${Object.values(speciesHighresMap).flat().length}`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('🔍 Verifying...');
  const { data: updated } = await supabase
    .from('species')
    .select('id, catalogue_name, lowres_image_url, highres_image_urls')
    .not('lowres_image_url', 'is', null);
  
  if (updated) {
    console.log(`✅ ${updated.length} species have images in database`);
  }
  
  console.log('\n🎉 Done! Your fish images are ready!\n');
}

uploadImages().catch(console.error);
