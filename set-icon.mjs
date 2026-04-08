import { rcedit } from 'rcedit';

async function setIcon() {
  try {
    await rcedit('Observer.exe', {
      icon: 'pkg-icon.ico'
    });
    console.log('Successfully set icon for Observer.exe');
  } catch (err) {
    console.error('Error setting icon:', err);
    process.exit(1);
  }
}

setIcon();
