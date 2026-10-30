import { Link } from 'react-router-dom'
import forHimImage from '../../../../images/store image/for him.webp'
import forHerImage from '../../../../images/store image/for her.webp'
import unisexImage from '../../../../images/store image/unisex.webp'
import signatureImage from '../../../../images/store image/signature collection.webp'
import discoveryImage from '../../../../images/store image/discovery sets.webp'

const collections = [
  {
    id: 'for-him',
    name: 'For Him',
    description: 'Grounded woods and considered spice.',
    image: forHimImage,
    query: 'gender=men',
  },
  {
    id: 'for-her',
    name: 'For Her',
    description: 'Petals, warmth and a softer kind of light.',
    image: forHerImage,
    query: 'gender=women',
  },
  {
    id: 'unisex',
    name: 'Unisex',
    description: 'Fragrance beyond the expected.',
    image: unisexImage,
    query: 'gender=unisex',
  },
  {
    id: 'signature',
    name: 'Signature Collection',
    description: 'Distinctive scents with a lasting point of view.',
    image: signatureImage,
    query: 'collection=signature',
  },
  {
    id: 'discovery',
    name: 'Discovery Sets',
    description: 'A little room to find your next favorite.',
    image: discoveryImage,
    query: 'collection=discovery',
  },
]

function CollectionGrid() {
  return (
    <section className="shop-collections section-wrap" id="collections">
      <div className="shop-collections-heading">
        <div>
          <p className="eyebrow">Find your notes</p>
          <h2>Scent, in every form.</h2>
        </div>
        <p>
          Explore the different sides of IKIRA, each composed with care and
          made to be discovered in your own way.
        </p>
      </div>

      <div className="category-grid">
        {collections.map((collection) => (
          <Link
            className="category-card"
            key={collection.id}
            to={`/shop?${collection.query}`}
          >
            <div className="category-art">
              <img
                className="category-image"
                src={collection.image}
                alt=""
                loading="lazy"
              />
            </div>
            <div className="category-copy">
              <h3>{collection.name}</h3>
              <p>{collection.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default CollectionGrid
