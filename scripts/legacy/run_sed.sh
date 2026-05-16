sed -i '' 's/| "spacer"//g' src/components/CircularStrand.tsx
sed -i '' 's/| "charm"//g' src/components/CircularStrand.tsx
sed -i '' '/if (item.type === "spacer")/,/}/d' src/components/CircularStrand.tsx
sed -i '' '/if (item.type === "charm")/,/}/d' src/components/CircularStrand.tsx

sed -i '' 's/| "spacer"//g' src/components/SortableCircularStrand.tsx
sed -i '' 's/| "charm"//g' src/components/SortableCircularStrand.tsx
sed -i '' '/if (item.type === "spacer")/,/}/d' src/components/SortableCircularStrand.tsx
sed -i '' '/if (item.type === "charm")/,/}/d' src/components/SortableCircularStrand.tsx
